module.exports = {
  siteTitle: 'Prosper Habada | Software Engineer',
  siteDescription:
    'Prosper Habada is an Educator and Software Engineer based in Accra, Ghana who specializes in developing (and occasionally designing) exceptional websites and applications.',
  siteKeywords:
    'Prosper Habada, Prosper, Habada, prosperhabada, software engineer, computer engineer, web developer, python, django, electronics',
  siteUrl: 'https://prosperhabada.com',
  siteLanguage: 'en_US',
  googleAnalyticsID: 'UA-162851782-1',
  googleVerification: 'YR4HV3TipEd2qW7y97_UZUOnG7cwr9G90jICy8YV8XQ',
  name: 'Prosper Habada',
  location: 'Accra, Ghana',
  email: 'prosperhabada@gmail.com',
  github: 'https://github.com/prosperhabada',
  twitterHandle: '@prosperhabada',
  socialMedia: [
    {
      name: 'GitHub',
      url: 'https://github.com/prosperhabada',
    },
    {
      name: 'Linkedin',
      url: 'https://www.linkedin.com/prosperhabada',
    },

    {
      name: 'Instagram',
      url: 'https://www.instagram.com/prosperhabada/',
    },
    {
      name: 'Twitter',
      url: 'https://twitter.com/prosperhabada',
    },
  ],

  navLinks: [
    {
      name: 'About',
      url: '/#about',
    },
    {
      name: 'Experience',
      url: '/#jobs',
    },
    {
      name: 'Work',
      url: '/#projects',
    },
    {
      name: 'Contact',
      url: '/#contact',
    },
  ],

  navHeight: 100,
  greenColor: '#64ffda',
  navyColor: '#0a192f',
  darkNavyColor: '#020c1b',

  srConfig: (delay = 200) => ({
    origin: 'bottom',
    distance: '20px',
    duration: 500,
    delay,
    rotate: { x: 0, y: 0, z: 0 },
    opacity: 0,
    scale: 1,
    easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    mobile: true,
    reset: false,
    useDelay: 'always',
    viewFactor: 0.25,
    viewOffset: { top: 0, right: 0, bottom: 0, left: 0 },
  }),
};
