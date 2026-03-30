import type {Config} from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        mist: '#f5f3ef',
        sand: '#e5d4c1',
        clay: '#7f5539',
        accent: '#db6a2a',
      },
    },
  },
  plugins: [],
};

export default config;
