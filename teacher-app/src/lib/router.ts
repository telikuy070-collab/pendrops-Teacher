/**
 * Minimal client-side router for PenDrops Мугалим.
 *
 * Uses the History API for navigation and supports nested routes.
 * Designed for vanilla JS/TS — no framework dependencies.
 *
 * Route format: '/groups/:groupId/students', '/homework', etc.
 *
 * Usage:
 * ```ts
 * const router = createRouter();
 * router.addRoute('/', () => renderHome());
 * router.addRoute('/groups/:groupId', (params) => renderGroup(params.groupId));
 * router.start();
 * ```
 */

type RouteHandler = (params: Record<string, string>) => void | Promise<void>;

interface Route {
  pattern: string;
  handler: RouteHandler;
}

class Router {
  private routes: Route[] = [];
  private currentPath: string = '/';

  addRoute(pattern: string, handler: RouteHandler) {
    this.routes.push({ pattern, handler });
  }

  private match(pattern: string, path: string | undefined): Record<string, string> | null {
    if (!path) return null;

    // Convert pattern like '/groups/:groupId' to regex
    const paramNames: string[] = [];
    const regexPattern = pattern
      .split('/')
      .map((segment) => {
        if (segment.startsWith(':')) {
          paramNames.push(segment.slice(1));
          return '([^/]+)';
        }
        return segment;
      })
      .join('/');

    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (!match) return null;

    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = match[i + 1] ?? '';
    });

    return params;
  }

  async navigate(path: string): Promise<boolean> {
    // Normalize path — remove query string for matching
    const cleanPath: string = path.split('?')[0] ?? '';

    for (const route of this.routes) {
      const params = this.match(route.pattern, cleanPath);
      if (params) {
        this.currentPath = cleanPath;
        try {
          await route.handler(params);
          return true;
        } catch (error) {
          console.error('[Router] Route handler error:', error);
          return false;
        }
      }
    }

    console.warn('[Router] No route matched:', cleanPath);
    return false;
  }

  start() {
    // Handle initial route
    this.navigate(window.location.pathname).catch(console.error);

    // Listen for back/forward
    window.addEventListener('popstate', (_e) => {
      const path = window.location.pathname + window.location.hash;
      this.navigate(path).catch(console.error);
    });
  }

  go(path: string) {
    window.history.pushState({}, '', path);
    this.navigate(path).catch(console.error);
  }

  back() {
    window.history.back();
  }

  replace(path: string) {
    window.history.replaceState({}, '', path);
    this.navigate(path).catch(console.error);
  }

  get current(): string {
    return this.currentPath;
  }
}

export function createRouter(): Router {
  return new Router();
}
