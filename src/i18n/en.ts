export const en = {
    common: {
        cancel: "Cancel",
        save: "Save",
        saveAll: "Save All",
        delete: "Delete",
        add: "Add",
        edit: "Edit",
        close: "Close",
        ok: "OK",
        confirm: "Confirm",
        search: "Search...",
        loading: "Loading cURL-UI...",
        none: "None"
    },
    app: {
        selectStarter: "Select a request or folder to get started."
    },
    mainLayout: {
        updatesAvailable: "A new version ({{version}}) is available!",
        download: "Download from GitHub",
        dismiss: "Dismiss",
        env: "Env:",
        noEnv: "No Environment",
        manageEnv: "Manage Environments",
        console: "Console"
    },
    titleBar: {
        title: "cURL-UI - {{name}}",
        userGuideTitle: "cURL-UI - User Guide",
        menu: {
            file: "File",
            newProject: "New Project",
            recentProjects: "Recent Projects",
            noOtherProjects: "No Other Projects",
            quit: "Quit",
            help: "Help",
            userGuide: "User Guide",
            about: "About"
        },
        controls: {
            minimize: "Minimize",
            restore: "Restore",
            maximize: "Maximize",
            close: "Close"
        }
    },
    prompt: {
        enterProjectName: "Enter Project Name:",
        newCollection: "New Collection Name:",
        newCollectionDefault: "New Collection",
        newRequest: "Request Name:",
        newRequestDefault: "New Request",
        newFolder: "Folder Name:",
        newFolderDefault: "New Folder",
        renameTo: "Rename to:",
        newExecution: "Enter execution name:",
        newExecutionDefault: "New Execution"
    },
    alert: {
        deleteFolder: "Delete folder \"{{name}}\"? This will delete all contents.",
        deleteRequest: "Delete request \"{{name}}\"?",
        deleteExecutionTitle: "Delete execution?",
        deleteExecutionMessage: "Are you sure you want to delete \"{{name}}\"?"
    },
    sidebar: {
        gitStatus: "Git Status",
        settings: "Settings",
        loadCollection: "Load",
        newCollection: "New",
        deleteProjectBtn: "Delete Project",
        deleteProjectTitle: "Delete project \"{{name}}\"?",
        deleteProjectMessage: "Are you sure you want to delete project \"{{name}}\"? This will delete the manifest file and close this window. Collections files will still be kept in the folders they are located in.",
        emptyCollection: "Empty",
        inGitRepo: "In Git Repository",
        notSaved: "Not saved",
        externalMocks: "External Mocks",
        noExternalMocks: "No External Mocks",
        fromScratch: "From Scratch",
        fromSwagger: "From Swagger",
        useCases: "Use Cases",
        mockManagerTitle: "{{name}} Mocks",
        menu: {
            save: "Save",
            newRequest: "New Request",
            newFolder: "New Folder",
            remove: "Remove",
            removeCollectionTitle: "Remove collection \"{{name}}\"?",
            removeCollectionMessage: "Are you sure you want to remove collection \"{{name}}\" from the project? The file will not be deleted from disk."
        }
    },
    contextMenu: {
        save: "Save",
        newRequest: "New Request",
        newFolder: "New Folder",
        import: "Import...",
        mockManager: "Mock Manager",
        exportPostman: "Export to Postman",
        remove: "Remove",
        rename: "Rename",
        duplicate: "Duplicate",
        delete: "Delete",
        addRequest: "Add Request",
        addFolder: "Add Folder",
        newExecution: "New Execution",
        closeOthers: "Close Others",
        closeAll: "Close All"
    },
    importModal: {
        title: "Import Requests",
        types: {
            curl: "cURL",
            swagger: "Swagger / OpenAPI",
            postmanCollection: "Postman Collection",
            postmanEnvironment: "Postman Environment"
        },
        hints: {
            curl: "Paste a bash-formatted cURL command below or load from a file.",
            swagger: "Paste your Swagger 2.0 or OpenAPI 3.x specification (JSON or YAML) below or load from a file.",
            postmanCollection: "Paste your Postman Collection v2.1 JSON below or load from a file.",
            postmanEnvironment: "Paste your Postman Environment JSON below or load from a file."
        },
        loadFromFile: "Load from File",
        clear: "Clear",
        importBtn: "Import"
    },
    aboutModal: {
        title: "About cURL-UI",
        subtitle: "A modern HTTP client built with Tauri.",
        appVersion: "App Version:",
        tauriVersion: "Tauri Version:",
        license: "License:",
        newVersionAvailable: "New version available: {{version}}",
        viewOnGitHub: "View on GitHub"
    },
    promptModal: {
        placeholder: "Enter value..."
    },
    gitPanel: {
        title: "Git Changes",
        globalCommitPush: "Global Commit & Push ({{count}} modified)",
        globalCommitPlaceholder: "Global commit message...",
        commitPushAllBtn: "All",
        noModifiedCollections: "No modified collections found.",
        commitPlaceholder: "Commit message...",
        resolveConflictBtn: "RESOLVE CONFLICT"
    },
    tableEditor: {
        key: "Key",
        value: "Value",
        addItem: "Add Item",
        inheritedItems: "Inherited Items",
        source: "Source",
        goToSource: "Go to source",
        addValue: "+ Add Value"
    },
    environmentManager: {
        title: "Manage Environments",
        newEnvironmentBaseName: "New Environment",
        deleteTitle: "Delete Environment",
        deleteMessage: "Are you sure you want to delete the environment \"{{name}}\"?",
        nameNotUnique: "Environment name must be unique.",
        newEnvBtn: "New Env",
        envNameLabel: "Environment Name",
        variablesLabel: "Variables",
        exportBtn: "Export",
        exportTitle: "Export to Postman",
        exportSuccess: "Environment exported to {{path}}",
        inheritedFromGlobal: "Inherited from Global",
        emptyKey: "(empty key)",
        overrideValue: "Override Value",
        addVariableBtn: "Add Variable",
        keyPlaceholder: "Key",
        valuePlaceholder: "Value",
        overridesGlobal: "Overrides Global variable",
        selectEnvironment: "Select an environment",
        globalEnvName: "Global"
    },
    useCaseManager: {
        title: "Use Case Manager",
        promptName: "Enter Use Case Name:",
        defaultName: "New Use Case",
        deleteConfirm: "Are you sure you want to delete this Use Case?",
        completedSuccess: "Use Case completed successfully!",
        failed: "Use Case failed{{stepInfo}}: {{message}}",
        stepFailed: "Step failed with status {{status}}. Expected: {{expected}}",
        newUseCaseBtn: "New Use Case",
        addStepBtn: "Add Step",
        blackboardTitle: "Blackboard Control Center",
        variableNamePrompt: "Variable name:",
        addInitialVarBtn: "Add Initial Variable",
        noVariablesDefined: "No variables defined. Initial variables and step responses will populate this.",
        volatileBadge: "VOLATILE",
        scriptTitle: "Optional Step Script",
        minimizeEditorBtn: "Minimize Editor",
        editScriptBtn: "Edit Script",
        selectUseCaseHint: "Select a Use Case from the list or create a new one.",
        savedBtn: "Saved!",
        saveChangesBtn: "Save Changes",
        selectExecutionPlaceholder: "Select Execution...",
        successLabel: "Success:",
        successPlaceholder: "200,2xx",
        completedBadge: "COMPLETED",
        failedBadge: "FAILED",
        searchPlaceholder: "Search executions...",
        defaultExecution: "Default Execution",
        noResults: "No results found",
        requestsMatched: "{{count}} requests matched",
        escToClose: "ESC to close"
    },
    requestEditor: {
        settingsTitle: "Request Settings",
        tabs: {
            params: "Params",
            body: "Body",
            headers: "Headers",
            auth: "Auth",
            scripts: "Scripts",
            preRequest: "Pre-request",
            postRequest: "Post-request"
        },
        body: {
            types: {
                none: "None",
                json: "JSON",
                xml: "XML",
                html: "HTML",
                formUrlEncoded: "Form UrlEncoded",
                multipart: "Multipart Form",
                text: "Text",
                javascript: "Javascript",
                yaml: "YAML"
            },
            typeColumn: "Type",
            valuesColumn: "Values",
            typesOptions: {
                text: "Text",
                file: "File"
            },
            filePathPlaceholder: "File path...",
            contentTypePlaceholder: "Content-Type",
            chooseFileTooltip: "Choose File",
            addField: "+ Add Field",
            bodyOverridden: "Body overridden",
            enterBodyPlaceholder: "Enter {{type}} body...",
            noBodyText: "This request has no body"
        },
        headers: {
            keyPlaceholder: "Header Key",
            valuePlaceholder: "Header Value",
            addHeader: "Add Header",
            inheritedHeaders: "Inherited Headers"
        },
        params: {
            keyPlaceholder: "Param Key",
            valuePlaceholder: "Param Value",
            addQueryParam: "Add Query Param",
            inheritedQueryParams: "Inherited Query Params"
        },
        scripts: {
            addScript: "Add Script",
            newScriptDefName: "New Script",
            newScriptDefCode: "console.log('Script');",
            noScripts: "No scripts defined.",
            runOnStatus: "Run on Status:",
            runOnStatusPlaceholder: "e.g. 200, 201, 2xx, 4xx (Empty = Always)"
        },
        namePlaceholder: "Request Name",
        previewUrl: "Preview: {{url}}",
        cancelBtn: "Cancel",
        runDefaultBtn: "Run Default",
        closeResultsTitle: "Close Results"
    },
    responsePanel: {
        title: "RESPONSE",
        tabs: {
            body: "Body",
            headers: "Headers",
            rawResponse: "Raw Response",
            rawRequest: "Raw Request",
            curl: "cURL"
        },
        noData: {
            requesting: "Requesting...",
            noResponse: "No response",
            noRequestData: "No request data",
            noCurlData: "No curl data"
        }
    },
    folderEditor: {
        folderNameLabel: "Folder Name",
        sharedHeadersTitle: "Shared Headers",
        noHeaders: "No headers defined.",
        inheritedHeadersTitle: "Inherited Headers",
        variablesTitle: "Variables",
        variablesHelpText: "Variables defined here can be used in requests within this folder using <code>{{{{variable_name}}}}</code> syntax.",
        noVariables: "No variables defined.",
        variableNamePlaceholder: "Variable Name",
        inheritedVariablesTitle: "Inherited Variables",
        authenticationTitle: "Authentication"
    },
    executionEditor: {
        orphanedExecution: "Parent request not found. The execution may be orphaned.",
        basedOn: "based on:",
        executionOverrides: "Execution Overrides",
        runBtn: "Run",
        cancelBtn: "Cancel"
    },
    codeEditor: {
        formatTooltip: "Format Code",
        formatting: "Formatting...",
        format: "Format"
    },
    welcome: {
        greeting: "Welcome to cURL-UI",
        recentProjects: "Recent Projects",
        noProjectsLine1: "It looks like you don't have any projects yet.",
        noProjectsLine2: "Start by creating your first project to organize your collections.",
        newProject: "New Project",
        userGuide: "User Guide",
        appVersion: "App v{{version}}",
        tauriVersion: "Tauri v{{version}}",
        storageNotice: "All your project data is stored locally in"
    },
    tabBar: {
        untitled: "Untitled"
    }
};
