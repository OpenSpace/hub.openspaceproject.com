import { render } from '@testing-library/react';
import { MantineProvider, type MantineThemeOverride } from '@mantine/core';

const theme: MantineThemeOverride = {
  // colorScheme: 'light',
  fontFamily: 'Inter, sans-serif',
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5C5F66',
      '#373A40',
      '#2C2E33',
      '#25262B',
      '#1A1B1E',
      '#141517',
      '#101113',
    ],
  },
  primaryColor: 'blue',
};

function customRender(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

export * from '@testing-library/react';
export { customRender as render };
