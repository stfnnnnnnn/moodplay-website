import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

/* v5 button. One pink filled button per screen, never in the top bar; Upload video is always blue. */
export type ButtonVariant = 'pink' | 'blue' | 'line' | 'ghost' | 'quiet' | 'danger';

const cls = (variant: ButtonVariant, lg?: boolean, extra?: string) =>
  ['btn', 'btn-' + variant, lg ? 'btn-lg' : '', extra || ''].filter(Boolean).join(' ');

type Common = { variant: ButtonVariant; lg?: boolean; children?: ReactNode };

export function Button({ variant, lg, className, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cls(variant, lg, className)} {...rest} />;
}

export function LinkButton({ variant, lg, className, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={cls(variant, lg, className)} {...rest} />;
}
