import { ResponseData } from '../../store';
import { CodeEditor } from '../CodeEditor';

interface ResponseRawTabProps {
    response: ResponseData;
}

export function ResponseRawTab({ response }: ResponseRawTabProps) {
    const value =
        `HTTP/1.1 ${response.status}\n` +
        (response.headers as string[][]).map(([k, v]) => `${k}: ${v}`).join('\n') +
        '\n\n' +
        response.body;

    return (
        <CodeEditor
            value={value}
            language="text"
            readOnly={true}
            height="100%"
        />
    );
}
