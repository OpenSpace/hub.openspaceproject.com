import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { cssVariablesResolver, theme } from '@/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <>
      <ColorSchemeScript defaultColorScheme="dark" />
      <MantineProvider
        theme={theme}
        defaultColorScheme="dark"
        cssVariablesResolver={cssVariablesResolver}
      >
        {children}
      </MantineProvider>
    </>
  );
}
