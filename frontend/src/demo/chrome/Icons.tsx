/* Inline icons from the v5 mockups (stroke icons, currentColor). */
type P = { size?: number };
const s = (size = 17) => ({ width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const });

export const IconSearch = ({ size = 16 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></svg>;
export const IconHelp = ({ size }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" /></svg>;
export const IconUpload = ({ size }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>;
export const IconPlus = ({ size = 20 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
export const IconDots = ({ size = 18 }: P) => <svg {...s(size)} fill="currentColor"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>;
export const IconLeft = ({ size = 18 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const IconPen = ({ size = 18 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="m13.5 6.5 4 4" /></svg>;
export const IconChev = ({ size = 18 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
export const IconPlay = ({ size = 24 }: P) => <svg {...s(size)} fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>;
export const IconDownload = ({ size }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>;
export const IconTrash = ({ size }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const IconFilm = ({ size = 26 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M3 15h18M8 5v14M16 5v14" /></svg>;
export const IconUp = ({ size = 26 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>;
export const IconQ = ({ size = 26 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IconDup = ({ size }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
export const IconCheck = ({ size = 14 }: P) => <svg {...s(size)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12 4 4 8-8" /></svg>;
