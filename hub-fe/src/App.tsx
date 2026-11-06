import '@mantine/core/styles.css';

import React from 'react';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TopMenuBar } from './components/TopMenuBar';
import { AuthProvider } from './contexts/AuthContext';
import { Router } from './Router';

import '@mantine/notifications/styles.css'; // Import notifications styles

export default function App() {
  return (
    <ThemeProvider>
      <ModalsProvider>
        <AuthProvider>
          <Router />
          <Notifications position="bottom-right" zIndex={1000} />
        </AuthProvider>
      </ModalsProvider>
    </ThemeProvider>
  );
}
