import {
  CSSVariablesResolver,
  defaultCssVariablesResolver,
  MantineTheme,
  MantineThemeOverride,
} from '@mantine/core';

export const theme: MantineThemeOverride = {
  primaryColor: 'blue',
  primaryShade: 6,
  defaultRadius: 'md',
  fontFamily:
    'Futura, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  components: {
    Card: {
      defaultProps: {
        shadow: 'sm',
        withBorder: true,
        radius: 'sm',
      },
      // Mantine v7 has no theme.colorScheme and renders these as inline styles (no nested
      // selectors), so colors are flat CSS light-dark() values that follow the color scheme.
      // Components that set their own style still override these
      styles: {
        root: {
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-9))',
          borderColor: 'light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-6))',
          color: 'light-dark(var(--mantine-color-dark-7), var(--mantine-color-white))',
        },
      },
    },
    Badge: {
      defaultProps: {
        variant: 'light',
        radius: 'sm',
      },
      // Variant colors come from CSS vars (like Button below). Badges with their own `color`
      // (e.g. tag badges) keep it
      vars: (_theme: MantineTheme, props: { variant?: string; color?: string }) => {
        if (props.color) {
          return { root: {} };
        }
        const variant = props.variant || 'light';
        if (variant === 'filled') {
          return {
            root: {
              '--badge-bg': 'light-dark(var(--mantine-color-blue-6), var(--mantine-color-blue-7))',
              '--badge-color': 'var(--mantine-color-white)',
            },
          };
        }
        if (variant === 'light' || variant === 'outline') {
          return {
            root: {
              '--badge-bg':
                variant === 'outline'
                  ? 'transparent'
                  : 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))',
              '--badge-color': 'light-dark(var(--mantine-color-dark-7), var(--mantine-color-white))',
              '--badge-bd':
                '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
            },
          };
        }
        return { root: {} };
      },
    },
    Button: {
      defaultProps: {
        size: 'sm',
        radius: 6,
      },
      // Flat root properties only - Mantine's styles-api renders these as a plain
      // inline style object, so nested selectors like '&:hover' or '&[data-variant]'
      // are silently dropped (Button doesn't even render a `data-variant` attribute -
      // variant-driven colors are consumed from CSS vars set by Button's own `vars`
      // resolver, which is why none of the above ever had any visible effect).
      styles: {
        root: {
          fontWeight: 550,
          height: 32,
          paddingLeft: 16,
          paddingRight: 16,
          transition: 'background-color .25s ease, color .25s ease, border-color .25s ease',
        },
      },
      // The correct place to override variant-driven colors: Button computes
      // --button-bg/--button-bd/--button-color/--button-hover from `variant`+`color`
      // via theme.variantColorResolver, so we override those CSS vars directly.
      // Buttons that pass their own `color` prop (e.g. the red Delete button) are
      // left alone so they keep Mantine's semantic color.
      vars: (_theme: MantineTheme, props: { variant?: string; color?: string }) => {
        if (props.color) {
          return { root: {} };
        }
        const variant = props.variant || 'filled';

        // Every value below (other than the brand lime accent, which has no
        // theme equivalent) resolves from the theme's own color CSS variables,
        // so the buttons stay in sync if the palette in `colors` ever changes.
        // Border color and text color are tracked as separate settings so each
        // can be tuned independently of the other.
        const borderColor = 'light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-1))';
        const textColor = 'light-dark(var(--mantine-color-dark-3), var(--mantine-color-gray-4))';
        const hoverBg = 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))';
        const hoverTextColor = 'light-dark(var(--mantine-color-dark-3), var(--mantine-color-white))';

        if (variant === 'filled') {
          return {
            root: {
              '--button-bg': 'light-dark(var(--mantine-color-blue-7), var(--mantine-color-blue-4))',
              '--button-hover':
                'light-dark(var(--mantine-color-blue-8), var(--mantine-color-gray-3))',
              '--button-color': 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-9))',
              '--button-hover-color':
                'light-dark(var(--mantine-color-white), var(--mantine-color-dark-9))',
              '--button-bd': 'none',
            },
          };
        }
        if (variant === 'light' || variant === 'outline') {
          return {
            root: {
              '--button-bg': 'transparent',
              '--button-bd': `1px solid ${borderColor}`,
              '--button-color': textColor,
              '--button-hover': hoverBg,
              '--button-hover-color': hoverTextColor,
              ...(variant === 'outline' ? { fontWeight: 700 } : {}),
            },
          };
        }
        if (variant === 'subtle') {
          return {
            root: {
              '--button-bg': 'transparent',
              '--button-color': textColor,
              '--button-hover': hoverBg,
              '--button-hover-color': hoverTextColor,
            },
          };
        }
        return { root: {} };
      },
    },
    ActionIcon: {
      defaultProps: {
        size: 'sm',
        radius: 'sm',
      },
      styles: {
        root: {
          height: 28,
          width: 28,
        },
      },
      // Variant colors via CSS vars, as for Button; icons with their own `color` keep it
      vars: (_theme: MantineTheme, props: { variant?: string; color?: string }) => {
        if (props.color) {
          return { root: {} };
        }
        const variant = props.variant || 'filled';
        if (variant === 'light') {
          return {
            root: {
              '--ai-bg': 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
              '--ai-hover': 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
              '--ai-color': 'light-dark(var(--mantine-color-dark-7), var(--mantine-color-white))',
            },
          };
        }
        if (variant === 'filled') {
          return {
            root: {
              '--ai-bg': 'light-dark(var(--mantine-color-blue-6), var(--mantine-color-blue-7))',
              '--ai-hover': 'light-dark(var(--mantine-color-blue-5), var(--mantine-color-blue-6))',
              '--ai-color': 'var(--mantine-color-white)',
            },
          };
        }
        return { root: {} };
      },
    },
    TextInput: {
      defaultProps: {
        variant: 'filled',
        radius: 'sm',
      },
      // Flat light-dark() values that follow the color scheme (see Card above)
      styles: {
        label: { color: 'var(--hub-color-heading)' },
        input: {
          backgroundColor: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
          borderColor: 'light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
          color: 'light-dark(var(--mantine-color-dark-7), var(--mantine-color-white))',
        },
      },
    },
    Select: {
      defaultProps: {
        variant: 'filled',
        radius: 'sm',
      },
      // Flat light-dark() values that follow the color scheme (see Card above)
      styles: {
        label: { color: 'var(--hub-color-heading)' },
        input: {
          backgroundColor: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
          borderColor: 'light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
          color: 'light-dark(var(--mantine-color-dark-7), var(--mantine-color-white))',
        },
      },
    },
    Paper: {
      defaultProps: {
        withBorder: true,
        radius: 'sm',
      },
      // Flat light-dark() values; see Card above
      styles: {
        root: {
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
          borderColor: 'light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-5))',
        },
      },
    },
    // No color overrides for Alert: Mantine's variant colors already follow the color scheme
    // and keep the red/blue tint that tells errors from info
    Modal: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Textarea: {
      defaultProps: {
        radius: 'sm',
      },
      styles: {
        label: { color: 'var(--hub-color-heading)' },
      },
    },
    FileInput: {
      defaultProps: {
        radius: 'sm',
      },
      styles: {
        label: { color: 'var(--hub-color-heading)' },
      },
    },
  },
  colors: {
    dark: [
      '#A6A7AB',
      '#909296',
      '#5C5F66',
      '#373A40',
      '#2C2E33',
      '#25262B',
      '#1A1B1E',
      '#141517',
      '#101113',
      '#0A0A0A',
    ],
    blue: [
      '#E3F2FD',
      '#BBDEFB',
      '#90CAF9',
      '#64B5F6',
      '#3dbdee',
      '#2196F3',
      '#1E88E5',
      '#1976D2',
      '#1565C0',
      '#0D47A1',
    ],
    green: [
      '#E8F5E9',
      '#C8E6C9',
      '#A5D6A7',
      '#81C784',
      '#66BB6A',
      '#4CAF50',
      '#43A047',
      '#388E3C',
      '#2E7D32',
      '#1B5E20',
    ],
    violet: [
      '#EDE7F6',
      '#D1C4E9',
      '#B39DDB',
      '#9575CD',
      '#7E57C2',
      '#673AB7',
      '#5E35B1',
      '#512DA8',
      '#4527A0',
      '#311B92',
    ],
    gray: [
      '#FFFFFF',
      '#F5F5F5',
      '#EEEEEE',
      '#E0E0E0',
      '#BDBDBD',
      '#9E9E9E',
      '#757575',
      '#616161',
      '#424242',
      '#212121',
    ],
    red: [
      '#fff5f5',
      '#ffe3e3',
      '#ffc9c9',
      '#ffa8a8',
      '#ff8787',
      '#ff6b6b',
      '#fa5252',
      '#de4e4e',
      '#e03131',
      '#c92a2a',
    ],
    yellow: [
      '#fff9db',
      '#d0f884',
      '#fff3bf',
      '#ffec99',
      '#ffe066',
      '#ffd43b',
      '#fcc419',
      '#fab005',
      '#f59f00',
      '#f08c00',
    ],
  },
  black: '#101113',
  white: '#FFFFFF',
  other: {
    // Custom values that can be accessed via theme.other
    headerHeight: 60,
    navbarWidth: 300,
  },
};

// The --hub-color-* variables are the hub's shared palette; use them instead of picking
// colors by color scheme in components
export const cssVariablesResolver: CSSVariablesResolver = (mantineTheme) => {
  const base = defaultCssVariablesResolver(mantineTheme);
  return {
    ...base,
    light: {
      ...base.light,
      '--mantine-color-anchor': 'var(--mantine-color-blue-6)',
      '--hub-color-heading': 'var(--mantine-color-dark-7)',
      '--hub-color-text': 'var(--mantine-color-dark-7)',
      '--hub-color-dimmed': 'var(--mantine-color-dark-2)',
      '--hub-color-panel': 'var(--mantine-color-white)',
      '--hub-color-card': 'var(--mantine-color-white)',
      '--hub-color-border': 'var(--mantine-color-gray-3)',
      '--hub-color-panel-border': 'var(--mantine-color-gray-3)',
    },
    dark: {
      ...base.dark,
      '--mantine-color-body': 'var(--mantine-color-dark-9)',
      '--mantine-color-anchor': 'var(--mantine-color-blue-4)',
      '--hub-color-heading': 'var(--mantine-color-white)',
      '--hub-color-text': 'var(--mantine-color-gray-3)',
      '--hub-color-dimmed': 'var(--mantine-color-gray-4)',
      '--hub-color-panel': 'var(--mantine-color-dark-8)',
      '--hub-color-card': 'var(--mantine-color-dark-7)',
      '--hub-color-border': 'var(--mantine-color-dark-4)',
      '--hub-color-panel-border': 'var(--mantine-color-dark-6)',
    },
  };
};
