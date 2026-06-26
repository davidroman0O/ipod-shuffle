import type { LayoutServerLoad } from './$types';

/** Pages set their title via the pathname; consumed by +layout.svelte. */
export const load: LayoutServerLoad = ({ url }) => {
	return { title: pageTitle(url.pathname) };
};

function pageTitle(pathname: string): string {
	if (pathname.startsWith('/devices')) return 'Devices';
	if (pathname.startsWith('/playlists')) return 'Playlists';
	if (pathname.startsWith('/library')) return 'Library';
	return 'ipod';
}
