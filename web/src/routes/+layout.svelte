<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { SidebarProvider, SidebarInset, SidebarTrigger } from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import AppSidebar from '$lib/components/app/app-sidebar.svelte';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<SidebarProvider>
	<AppSidebar />
	<SidebarInset>
		<header class="flex h-14 items-center gap-2 border-b px-4">
			<SidebarTrigger />
			<Separator orientation="vertical" class="mx-1 h-4" />
			<h1 class="text-sm font-medium">{data.title ?? 'ipod'}</h1>
		</header>
		<main class="flex-1 overflow-hidden p-4 md:p-6">
			{@render children()}
		</main>
	</SidebarInset>
</SidebarProvider>

<Toaster />
