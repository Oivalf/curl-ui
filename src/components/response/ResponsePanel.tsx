import { ResponseData, itemResponseTabStates } from '../../store';
import { formatBytes } from "../../utils/format";
import { ResponseBodyTab } from "./ResponseBodyTab";
import { ResponseHeadersTab } from "./ResponseHeadersTab";
import { ResponseRawTab } from "./ResponseRawTab";
import { ResponseRawRequestTab } from "./ResponseRawRequestTab";
import { ResponseCurlTab } from "./ResponseCurlTab";
import { t } from "../../i18n";

interface ResponsePanelProps {
    id: string;
    response: ResponseData | null;
}

export function ResponsePanel({ id, response }: ResponsePanelProps) {
    const activeResponseTab = itemResponseTabStates.value[id] || 'body';

    const setActiveResponseTab = (tab: string) => {
        itemResponseTabStates.value = { ...itemResponseTabStates.value, [id]: tab };
    };

    const noDataMessage = (msg: string) => (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>{msg}</div>
    );

    const renderTabContent = () => {
        if (activeResponseTab === 'body') {
            if (!response || response.status === 0) {
                return noDataMessage(response?.status === 0 ? t('responsePanel.noData.requesting') : t('responsePanel.noData.noResponse'));
            }
            return <ResponseBodyTab response={response} />;
        }

        if (activeResponseTab === 'headers') {
            if (!response || response.status === 0) {
                return noDataMessage(response?.status === 0 ? t('responsePanel.noData.requesting') : t('responsePanel.noData.noResponse'));
            }
            return <ResponseHeadersTab headers={response.headers as string[][]} />;
        }

        if (activeResponseTab === 'raw_response') {
            if (!response || response.status === 0) {
                return noDataMessage(response?.status === 0 ? t('responsePanel.noData.requesting') : t('responsePanel.noData.noResponse'));
            }
            return <ResponseRawTab response={response} />;
        }

        if (activeResponseTab === 'raw_request') {
            if (response?.requestRaw) {
                return <ResponseRawRequestTab requestRaw={response.requestRaw} />;
            }
            return noDataMessage(t('responsePanel.noData.noRequestData'));
        }

        if (activeResponseTab === 'curl') {
            if (response?.requestCurl) {
                return <ResponseCurlTab requestCurl={response.requestCurl} />;
            }
            return noDataMessage(t('responsePanel.noData.noCurlData'));
        }

        return null;
    };

    const tabStyle = (tab: string) => ({
        margin: 0,
        fontSize: '0.9rem',
        cursor: 'pointer',
        opacity: activeResponseTab === tab ? 1 : 0.5,
        borderBottom: activeResponseTab === tab ? '2px solid var(--accent-primary)' : 'none'
    });

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('responsePanel.title')}</span>
                <h3 style={tabStyle('body')} onClick={() => setActiveResponseTab('body')}>{t('responsePanel.tabs.body')}</h3>
                <h3 style={tabStyle('headers')} onClick={() => setActiveResponseTab('headers')}>{t('responsePanel.tabs.headers')}</h3>
                <h3 style={tabStyle('raw_response')} onClick={() => setActiveResponseTab('raw_response')}>{t('responsePanel.tabs.rawResponse')}</h3>
                <h3 style={tabStyle('raw_request')} onClick={() => setActiveResponseTab('raw_request')}>{t('responsePanel.tabs.rawRequest')}</h3>
                <h3 style={tabStyle('curl')} onClick={() => setActiveResponseTab('curl')}>{t('responsePanel.tabs.curl')}</h3>
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
                minHeight: 0,
                minWidth: 0
            }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
}
