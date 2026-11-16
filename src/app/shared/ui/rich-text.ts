import { Component, computed, input } from '@angular/core';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Question banks use a sliver of Markdown (images, **bold**, line breaks). The text is escaped
 * first so only these constructs become markup; Angular's sanitizer still guards [innerHTML].
 */
export function toHtml(text: string): string {
  return escapeHtml(text.trim())
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)\s]+|[\w./-]+)\)/g,
      '<img src="$2" alt="$1" class="my-3 max-w-full rounded-lg border border-line" loading="lazy">',
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/ {2,}\n/g, '\n')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

@Component({
  selector: 'ui-rich-text',
  template: `<div [innerHTML]="html()"></div>`,
})
export class RichText {
  readonly text = input.required<string>();
  protected readonly html = computed(() => toHtml(this.text()));
}
