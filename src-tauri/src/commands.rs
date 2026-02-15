use crate::MockServerState;
use axum::{
    http::{HeaderMap, Method as HttpMethod, StatusCode},
    response::IntoResponse,
    routing::any,
    Router,
};
use git2::{IndexAddOption, Repository, Signature, StatusOptions};
use reqwest::{multipart, Method};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tauri::{command, path::BaseDirectory, Manager};
use tokio::fs;
use tokio::net::TcpListener;
use tokio::sync::oneshot;

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
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    #[serde(default)]
    pub form_data: Option<Vec<FormDataItem>>,
    pub request_id: Option<String>,
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
pub async fn http_request(
    state: tauri::State<'_, crate::HttpRequestState>,
    args: HttpRequestArgs,
) -> Result<HttpResponse, String> {
    let (tx, rx) = oneshot::channel::<()>();
    let request_id = args.request_id.clone();

    if let Some(id) = &request_id {
        let mut handles = state.handles.lock().await;
        handles.insert(id.clone(), tx);
    }

    let request_future = async {
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
    };

    let result = tokio::select! {
        res = request_future => res,
        _ = rx => Err("Canceled".to_string()),
    };

    if let Some(id) = &request_id {
        let mut handles = state.handles.lock().await;
        handles.remove(id);
    }

    result
}

#[command]
pub async fn cancel_http_request(
    state: tauri::State<'_, crate::HttpRequestState>,
    request_id: String,
) -> Result<(), String> {
    let mut handles = state.handles.lock().await;
    if let Some(tx) = handles.remove(&request_id) {
        let _ = tx.send(());
    }
    Ok(())
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
pub fn is_git_repo(path: String) -> Result<bool, String> {
    match Repository::discover(&path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
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
pub fn git_add_file(path: String) -> Result<(), String> {
    let repo = Repository::discover(&path).map_err(|e| e.to_string())?;
    let path_path = std::path::Path::new(&path);

    // Get relative path
    let workdir = repo.workdir().ok_or("No workdir")?;
    let relative_path = path_path.strip_prefix(workdir).map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_path(relative_path).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn git_reset(path: String) -> Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let head_obj = head.peel_to_commit().map_err(|e| e.to_string())?;

    repo.reset(head_obj.as_object(), git2::ResetType::Mixed, None)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn git_commit(args: GitCommitArgs) -> Result<String, String> {
    let repo = Repository::open(&args.path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

    let signature = Signature::now("cURL-UI", "curl-ui@local").map_err(|e| e.to_string())?;

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
pub fn get_git_root(path: String) -> Result<String, String> {
    let repo = Repository::discover(&path).map_err(|e| e.to_string())?;
    let path = repo.path().parent().unwrap_or(repo.path());
    Ok(path.to_string_lossy().to_string())
}

#[command]
pub fn git_push(path: String) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote("origin").map_err(|e| e.to_string())?;

    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, allowed_types| {
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
        } else {
            git2::Cred::default()
        }
    });

    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let head = repo.head().map_err(|e| e.to_string())?;
    let branch_name = head.shorthand().unwrap_or("master");
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    remote
        .push(&[refspec], Some(&mut push_opts))
        .map_err(|e| e.to_string())?;

    Ok("Pushed successfully".to_string())
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectManifest {
    pub name: String,
    pub collections: Vec<String>,
    #[serde(default)]
    pub external_mocks: Vec<String>,
}

#[command]
pub async fn sync_project_manifest(
    app_handle: tauri::AppHandle,
    name: String,
    collection_paths: Vec<String>,
    external_mock_paths: Vec<String>,
) -> Result<(), String> {
    use tauri::Manager;

    let home_dir = app_handle.path().home_dir().map_err(|e| e.to_string())?;
    let config_dir = home_dir.join(".curl-ui");

    // Ensure config dir exists (it should from startup, but safety first)
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let manifest_path = config_dir.join(format!("{}.json", name));
    let manifest = ProjectManifest {
        name,
        collections: collection_paths,
        external_mocks: external_mock_paths,
    };

    let data = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(manifest_path, data)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn list_projects(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    use tauri::Manager;

    let home_dir = app_handle.path().home_dir().map_err(|e| e.to_string())?;
    let config_dir = home_dir.join(".curl-ui");

    if !config_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    if let Ok(rd_entries) = std::fs::read_dir(config_dir) {
        for entry in rd_entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                            entries.push((name.to_string(), modified));
                        }
                    }
                }
            }
        }
    }

    // Sort by modification time (newest first)
    entries.sort_by(|a, b| b.1.cmp(&a.1));

    Ok(entries.into_iter().map(|(name, _)| name).collect())
}

#[command]
pub async fn get_project_manifest(
    app_handle: tauri::AppHandle,
    name: String,
) -> Result<ProjectManifest, String> {
    use tauri::Manager;

    let home_dir = app_handle.path().home_dir().map_err(|e| e.to_string())?;
    let manifest_path = home_dir.join(".curl-ui").join(format!("{}.json", name));

    if !manifest_path.exists() {
        return Err(format!("Manifest for project {} not found", name));
    }

    let data = fs::read_to_string(manifest_path)
        .await
        .map_err(|e| e.to_string())?;
    let manifest: ProjectManifest = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    Ok(manifest)
}

#[tauri::command]
pub async fn get_user_guide_content(
    app_handle: tauri::AppHandle,
    page: String,
) -> Result<String, String> {
    let path = app_handle
        .path()
        .resolve(
            format!("docs/user-guide/{}.md", page),
            BaseDirectory::Resource,
        )
        .map_err(|e| format!("Failed to resolve resource path: {}", e))?;

    if !path.exists() {
        return Err(format!("Guide file not found at: {}", path.display()));
    }

    fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read guide ({}): {}", path.display(), e))
}

#[command]
pub async fn delete_project(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
    use tauri::Manager;

    let home_dir = app_handle.path().home_dir().map_err(|e| e.to_string())?;
    let manifest_path = home_dir.join(".curl-ui").join(format!("{}.json", name));

    if manifest_path.exists() {
        std::fs::remove_file(manifest_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MockResponseDefinition {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MockRequestDefinition {
    pub method: String,
    pub path: String,
    pub response: MockResponseDefinition,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartMockArgs {
    pub collection_id: String,
    pub port: u16,
    pub requests: Vec<MockRequestDefinition>,
}

#[command]
pub async fn start_mock_server(
    state: tauri::State<'_, MockServerState>,
    args: StartMockArgs,
) -> Result<(), String> {
    let mut handles = state.handles.lock().await;
    if let Some(tx) = handles.remove(&args.collection_id) {
        let _ = tx.send(());
    }

    let mock_data = Arc::new(args.requests);

    let app = Router::new().fallback(any(move |method: HttpMethod, uri: axum::http::Uri| {
        let mock_data = Arc::clone(&mock_data);
        async move {
            let target_path = uri.path();
            let target_method = method.as_str().to_uppercase();
            let target_full_uri = uri
                .path_and_query()
                .map(|pq| pq.as_str())
                .unwrap_or(target_path);

            // Debug logs
            eprintln!(
                "Mock Server: Received {} {}",
                target_method, target_full_uri
            );

            // Pass 1: Try exact match (Method + Path + Query)
            let exact_match = mock_data.iter().find(|m| {
                let m_path = if m.path.starts_with('/') {
                    m.path.clone()
                } else {
                    format!("/{}", m.path)
                };
                m.method.to_uppercase() == target_method && m_path == target_full_uri
            });

            let matching = if let Some(m) = exact_match {
                eprintln!("Mock Server: Matched Exact: {}", m.path);
                Some(m)
            } else {
                // Pass 2: Fallback to path-only match (Method + Path), ignoring query params in request
                // BUT only if the mock definition ITSELF doesn't have a query string (is generic)
                let fuzzy_match = mock_data.iter().find(|m| {
                    let m_path = if m.path.starts_with('/') {
                        m.path.clone()
                    } else {
                        format!("/{}", m.path)
                    };
                    !m_path.contains('?')
                        && m.method.to_uppercase() == target_method
                        && m_path == target_path
                });
                if let Some(m) = fuzzy_match {
                    eprintln!("Mock Server: Matched Generic: {}", m.path);
                    Some(m)
                } else {
                    eprintln!("Mock Server: No match found");
                    None
                }
            };

            if let Some(m) = matching {
                let mut hm = HeaderMap::new();
                for (k, v) in &m.response.headers {
                    if let (Ok(name), Ok(val)) = (
                        axum::http::HeaderName::from_bytes(k.as_bytes()),
                        axum::http::HeaderValue::from_bytes(v.as_bytes()),
                    ) {
                        hm.insert(name, val);
                    }
                }

                let status = StatusCode::from_u16(m.response.status_code).unwrap_or(StatusCode::OK);
                (status, hm, m.response.body.clone()).into_response()
            } else {
                StatusCode::NOT_FOUND.into_response()
            }
        }
    }));

    let (tx, rx) = oneshot::channel::<()>();
    handles.insert(args.collection_id.clone(), tx);

    let addr = format!("0.0.0.0:{}", args.port);
    let listener = TcpListener::bind(&addr).await.map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        let server = axum::serve(listener, app).with_graceful_shutdown(async move {
            let _ = rx.await;
        });
        if let Err(e) = server.await {
            eprintln!("Mock server error: {}", e);
        }
    });

    Ok(())
}

#[command]
pub async fn stop_mock_server(
    state: tauri::State<'_, MockServerState>,
    collection_id: String,
) -> Result<(), String> {
    let mut handles = state.handles.lock().await;
    if let Some(tx) = handles.remove(&collection_id) {
        let _ = tx.send(());
        Ok(())
    } else {
        Err("No mock server running for this collection".into())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub is_available: bool,
    pub latest_version: String,
    pub release_url: String,
}

#[command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current_version_str = app.package_info().version.to_string();
    let current_version = semver::Version::parse(&current_version_str).map_err(|e| {
        format!(
            "Failed to parse current version '{}': {}",
            current_version_str, e
        )
    })?;

    let client = reqwest::Client::builder()
        .user_agent("curl-ui")
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get("https://api.github.com/repos/Oivalf/curl-ui/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch latest release: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned error: {}", response.status()));
    }

    let release_data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release data: {}", e))?;

    let latest_version_tag = release_data["tag_name"]
        .as_str()
        .ok_or("Missing tag_name in release data")?;

    // Find the start of the version number (first digit)
    let start_index = latest_version_tag
        .find(|c: char| c.is_ascii_digit())
        .unwrap_or(0);
    let latest_version_str = &latest_version_tag[start_index..];

    let latest_version = semver::Version::parse(latest_version_str).map_err(|e| {
        format!(
            "Failed to parse latest version '{}' (from tag '{}'): {}",
            latest_version_str, latest_version_tag, e
        )
    })?;

    let release_url = release_data["html_url"]
        .as_str()
        .ok_or("Missing html_url in release data")?
        .to_string();

    crate::rust_info!(&app, "Current version: {}", current_version);
    crate::rust_info!(&app, "Latest version: {}", latest_version);
    crate::rust_info!(&app, "Release url: {}", release_url);

    // Semantic comparison
    let is_available = latest_version > current_version;

    Ok(UpdateInfo {
        is_available,
        latest_version: latest_version.to_string(),
        release_url,
    })
}
