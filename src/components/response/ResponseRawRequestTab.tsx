import { CodeEditor } from '../CodeEditor';

interface ResponseRawRequestTabProps {
    requestRaw: string;
}

export function ResponseRawRequestTab({ requestRaw }: ResponseRawRequestTabProps) {
    return (
        <CodeEditor
            value={requestRaw}
            language="text"
            readOnly={true}
            height="100%"
        />
    );
}
