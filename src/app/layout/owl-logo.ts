import { Component } from '@angular/core';

/**
 * Perf Owl header mark. Drawn inline rather than as an <img> so the glancing pupils
 * (styles.css `.owl-pupils`) obey the in-app reduced-motion setting, which an image can't see.
 */
@Component({
  selector: 'app-owl-logo',
  host: { class: 'block size-9 shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 64 64" class="block size-full">
      <rect width="64" height="64" rx="16" fill="#3B5BDB" />
      <path d="M13.5 23L8.5 6.5L21.5 15.5Q32 12 42.5 15.5L55.5 6.5L50.5 23C56.5 35 53 52 32 57.5C11 52 7.5 35 13.5 23Z" fill="#23348C" />
      <path d="M10.8 10L19.2 16L15.4 19ZM53.2 10L44.8 16L48.6 19Z" fill="#8FA3EE" />
      <circle cx="21.5" cy="32" r="13" fill="#4D6AE0" />
      <circle cx="42.5" cy="32" r="13" fill="#4D6AE0" />
      <circle cx="21.5" cy="32" r="10" fill="#FFFFFF" stroke="#1A2A70" stroke-width="0.8" />
      <circle cx="42.5" cy="32" r="10" fill="#FFFFFF" stroke="#1A2A70" stroke-width="0.8" />
      <g class="owl-pupils">
        <circle cx="21.5" cy="32" r="4.6" fill="#16181D" />
        <circle cx="42.5" cy="32" r="4.6" fill="#16181D" />
        <circle cx="20" cy="30.5" r="1.4" fill="#FFFFFF" />
        <circle cx="41" cy="30.5" r="1.4" fill="#FFFFFF" />
      </g>
      <path d="M29.6 18.6L32 22L34.4 18.6Z" fill="#1A2A70" />
      <path d="M28.6 41.5L35.4 41.5L32 48.5Z" fill="#F2B66B" />
      <path d="M32 41.5L35.4 41.5L32 48.5Z" fill="#D9903A" />
      <path d="M24 50.5l2.2 1.6 2.2-1.6M35.6 50.5l2.2 1.6 2.2-1.6" fill="none" stroke="#4D6AE0" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
})
export class OwlLogo {}
