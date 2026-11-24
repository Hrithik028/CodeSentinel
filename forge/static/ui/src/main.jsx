import '@atlaskit/css-reset';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { view } from '@forge/bridge';
import Spinner from '@atlaskit/spinner';
import ConfigPage from './ConfigPage.jsx';
import Gadget from './Gadget.jsx';
import GadgetEdit from './GadgetEdit.jsx';

function App() {
  const [context, setContext] = useState(null);
  useEffect(() => {
    view.theme?.enable?.();
    view.getContext().then(setContext);
  }, []);
  if (!context) return <Spinner size="medium" />;
  if (context.moduleKey === 'config-page') return <ConfigPage context={context} />;
  if (context.extension?.entryPoint === 'edit') return <GadgetEdit context={context} />;
  return <Gadget context={context} />;
}

createRoot(document.getElementById('root')).render(<App />);
