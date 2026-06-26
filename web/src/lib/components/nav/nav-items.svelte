<script lang="ts">
	import {
		SidebarGroup,
		SidebarGroupContent,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton
	} from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/state';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Folder from '@lucide/svelte/icons/folder';

	const items = [
		{ href: '/devices', label: 'Devices', icon: HardDrive },
		{ href: '/playlists', label: 'Playlists', icon: ListMusic },
		{ href: '/library', label: 'Library', icon: Folder }
	] as const;
</script>

<SidebarGroup>
	<SidebarGroupContent>
		<SidebarMenu>
			{#each items as item (item.href)}
				{@const active = page.url.pathname.startsWith(item.href)}
				<SidebarMenuItem>
					<SidebarMenuButton isActive={active} tooltipContent={item.label}>
						{#snippet child({ props })}
							<a href={item.href} {...props}>
								<item.icon />
								<span>{item.label}</span>
							</a>
						{/snippet}
					</SidebarMenuButton>
				</SidebarMenuItem>
			{/each}
		</SidebarMenu>
	</SidebarGroupContent>
</SidebarGroup>
