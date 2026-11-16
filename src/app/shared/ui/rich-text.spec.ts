import { toHtml } from './rich-text';

describe('toHtml', () => {
  it('escapes markup so question text cannot inject HTML', () => {
    expect(toHtml('a <script>x</script> & b')).toBe('a &lt;script&gt;x&lt;/script&gt; &amp; b');
  });

  it('renders the Markdown subset the banks use', () => {
    expect(toHtml('Pick **ONE**')).toBe('Pick <strong>ONE</strong>');
    expect(toHtml('line1  \n  \nline2')).toBe('line1<br><br>line2');
    expect(toHtml('![Question Image](https://cdn.x/a.png)')).toContain('<img src="https://cdn.x/a.png" alt="Question Image"');
  });

  it('does not turn javascript: links into images', () => {
    expect(toHtml('![x](javascript:alert(1))')).not.toContain('<img');
  });
});
