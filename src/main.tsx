import React from 'react';import{createRoot}from'react-dom/client';import'./styles.css';import{StoreProvider}from'./store';import App from'./App';
createRoot(document.getElementById('root')!).render(<React.StrictMode><StoreProvider><App/></StoreProvider></React.StrictMode>);
