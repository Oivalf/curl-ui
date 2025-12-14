use git2::{IndexAddOption, Repository, Signature, StatusOptions};
use reqwest::{multipart, Method};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path;
use std::str::FromStr;
use tauri::command;
use tokio::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FormDataItem {
    key: String,
    value: String,
    entry_type: String, // "text" or "file"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpRequestArgs {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    #[serde(default)]
    form_data: Option<Vec<FormDataItem>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileStatus {
    path: String,
    status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommitArgs {
    path: String,
    message: String,
}

#[command]
pub async fn http_request(args: HttpRequestArgs) -> Result<HttpResponse, String> {
    let client = reqwest::Client::new();

    let method = Method::from_str(&args.method.to_uppercase())
        .map_err(|e| format!("Invalid method: {}", e))?;

    let mut request_builder = client.request(method, &args.url);

    for (key, value) in args.headers {
        request_builder = request_builder.header(key, value);
    }

    if let Some(form_data) = args.form_data {
        let mut form = multipart::Form::new();
        for item in form_data {
            if item.entry_type == "file" {
                // For files, value is the path
                // handling async file read inside this loop might be tricky if we want to bubble errors
                let part = multipart::Part::bytes(
                    tokio::fs::read(&item.value)
                        .await
                        .map_err(|e| format!("Failed to read file {}: {}", item.value, e))?,
                )
                .file_name(
                    std::path::Path::new(&item.value)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                );
                form = form.part(item.key, part);
            } else {
                form = form.text(item.key, item.value);
            }
        }
        request_builder = request_builder.multipart(form);
    } else if let Some(body) = args.body {
        request_builder = request_builder.body(body);
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();

    let mut headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read body: {}", e))?;

    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

#[command]
pub fn git_init(path: String) -> Result<String, String> {
    Repository::init(&path).map_err(|e| e.to_string())?;
    Ok("Initialized successfully".to_string())
}

#[command]
pub fn git_status(path: String) -> Result<Vec<FileStatus>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        let status_str = if status.is_index_new() || status.is_wt_new() {
            "New"
        } else if status.is_index_modified() || status.is_wt_modified() {
            "Modified"
        } else if status.is_index_deleted() || status.is_wt_deleted() {
            "Deleted"
        } else {
            "Unknown"
        };

        result.push(FileStatus {
            path,
            status: status_str.to_string(),
        });
    }

    Ok(result)
}

#[command]
pub fn git_add_all(path: String) -> Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;

    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn git_commit(args: GitCommitArgs) -> Result<String, String> {
    let repo = Repository::open(&args.path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

    let signature = Signature::now("Curl UI", "curl-ui@local").map_err(|e| e.to_string())?;

    let parent_commit = match repo.head() {
        Ok(head) => {
            let target = head.target().unwrap();
            Some(repo.find_commit(target).map_err(|e| e.to_string())?)
        }
        Err(_) => None,
    };

    let parents = match &parent_commit {
        Some(c) => vec![c],
        None => vec![],
    };

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &args.message,
        &tree,
        &parents,
    )
    .map_err(|e| e.to_string())?;

    Ok("Committed successfully".to_string())
}

#[command]
pub async fn save_workspace(path: String, data: String) -> Result<(), String> {
    fs::write(&path, data).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn load_workspace(path: String) -> Result<String, String> {
    let data = fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    Ok(data)
}
