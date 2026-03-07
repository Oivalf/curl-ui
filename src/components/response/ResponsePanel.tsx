import { useSignal } from "@preact/signals";
import { ResponseData } from '../../store';
import { formatBytes } from "../../utils/format";
import { ResponseBodyTab } from "./ResponseBodyTab";
import { ResponseHeadersTab } from "./ResponseHeadersTab";
import { ResponseRawTab } from "./ResponseRawTab";
import { ResponseRawRequestTab } from "./ResponseRawRequestTab";
import { ResponseCurlTab } from "./ResponseCurlTab";

export interface ResponsePanelProps {
    response: ResponseData | null;
}

export function ResponsePanel({ response }: ResponsePanelProps) {
    const activeResponseTab = useSignal<'body' | 'headers' | 'raw_response' | 'raw_request' | 'curl'>('body');

    const noDataMessage = (msg: string) => (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>{msg}</div>
    );

    const renderTabContent = () => {
        if (activeResponseTab.value === 'body') {
            if (!response || response.status === 0) {
                return noDataMessage(response?.status === 0 ? 'Requesting...' : 'No response');
            }
            return <ResponseBodyTab response={response} />;
        }

        if (activeResponseTab.value === 'headers') {
            if (!response || response.status === 0) {
                return noDataMessage(response?.status === 0 ? 'Requesting...' : 'No response');
            }
            return <ResponseHeadersTab headers={response.headers as string[][]} />;
        }

        if (activeResponseTab.value === 'raw_response') {
            if (!response || response.status === 0) {
                return noDataMessage(response?.status === 0 ? 'Requesting...' : 'No response');
            }
            return <ResponseRawTab response={response} />;
        }

        if (activeResponseTab.value === 'raw_request') {
            if (response?.requestRaw) {
                return <ResponseRawRequestTab requestRaw={response.requestRaw} />;
            }
            return noDataMessage('No request data');
        }

        if (activeResponseTab.value === 'curl') {
            if (response?.requestCurl) {
                return <ResponseCurlTab requestCurl={response.requestCurl} />;
            }
            return noDataMessage('No curl data');
        }

        return null;
    };

    const tabStyle = (tab: typeof activeResponseTab.value) => ({
        margin: 0,
        fontSize: '0.9rem',
        cursor: 'pointer',
        opacity: activeResponseTab.value === tab ? 1 : 0.5,
        borderBottom: activeResponseTab.value === tab ? '2px solid var(--accent-primary)' : 'none'
    });

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>RESPONSE</span>
                <h3 style={tabStyle('body')} onClick={() => activeResponseTab.value = 'body'}>Body</h3>
                <h3 style={tabStyle('headers')} onClick={() => activeResponseTab.value = 'headers'}>Headers</h3>
                <h3 style={tabStyle('raw_response')} onClick={() => activeResponseTab.value = 'raw_response'}>Raw Response</h3>
                <h3 style={tabStyle('raw_request')} onClick={() => activeResponseTab.value = 'raw_request'}>Raw Request</h3>
                <h3 style={tabStyle('curl')} onClick={() => activeResponseTab.value = 'curl'}>Curl</h3>
                {response && (
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', maxWidth: '50%' }}>
                        <span style={{
                            color: response.status >= 200 && response.status < 300 ? 'var(--success)' :
                                response.status >= 400 ? 'var(--error)' :
                                    response.status === 0 ? 'var(--text-muted)' : 'var(--warning)',
                            fontWeight: 'bold'
                        }}>
                            {response.status === 0 ? '...' : response.status}
                        </span>
                        {response.size !== undefined && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {formatBytes(response.size)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div style={{
                flex: 1,
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-sm)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
            }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
}
