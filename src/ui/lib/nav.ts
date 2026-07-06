export function navAriaCurrent(path: string, href: string) {
  return path === href ? 'page' : undefined
}
