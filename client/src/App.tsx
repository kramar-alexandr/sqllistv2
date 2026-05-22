import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ORVCList from './components/ORVCList';
import IVVCList from './components/IVVCList';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

// URL path: /list/ORVC/html/list-2.html → 'ORVC'
function getTableFromPath(): string {
  return window.location.pathname.split('/')[2]?.toUpperCase() || 'ORVC';
}

// URL params: ?compno=1&salesman=ABC&salesgroup=GRP&user=ABC&searchstr=query
function getParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

function AppContent() {
  const table = getTableFromPath();
  const props = {
    compno:     getParam('compno') || '1',
    salesman:   getParam('salesman'),
    salesgroup: getParam('salesgroup'),
    user:       getParam('user'),
    searchstr:  getParam('searchstr'),
  };

  if (table === 'ORVC') return <ORVCList {...props} />;
  if (table === 'IVVC') return <IVVCList compno={props.compno} salesman={props.salesman} salesgroup={props.salesgroup} user={props.user} />;

  return (
    <div style={{ padding: 24, color: '#888' }}>
      Таблица <strong>{table}</strong> пока не реализована.
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
