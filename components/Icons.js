// The icon sprite (rendered once in the root layout) and a tiny <Ico name="car" /> helper that uses it.
import { SYMBOLS } from "./icon-symbols";

export function IconSprite() {
  return <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SYMBOLS }} />;
}

export function Ico({ name, className = "ico", style }) {
  return <svg className={className} style={style} aria-hidden="true"><use href={`#i-${name}`} /></svg>;
}
