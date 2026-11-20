export function Icon({ name, className = '' }) {
  return <span aria-hidden="true" className={`icon text-[18px] ${className}`}>{name}</span>;
}
