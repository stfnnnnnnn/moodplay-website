/* Info button for a setting (v5-upload.html). Its help text lives in the element named by `help`; useInfoTips shows it. */
export function InfoButton({ help, label }: { help: string; label: string }) {
  return (
    <button className="info" type="button" data-tip={help} aria-label={'About ' + label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.01" /></svg>
    </button>
  );
}
