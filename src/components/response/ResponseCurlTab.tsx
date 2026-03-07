import { RequestCurlView } from '../request/RequestCurlView';

interface ResponseCurlTabProps {
    requestCurl: string;
}

export function ResponseCurlTab({ requestCurl }: ResponseCurlTabProps) {
    return <RequestCurlView curlCommand={requestCurl} />;
}
