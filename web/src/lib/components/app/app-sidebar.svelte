<script lang="ts">
	import {
		Sidebar,
		SidebarHeader,
		SidebarContent,
		SidebarFooter,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton,
		SidebarRail
	} from '$lib/components/ui/sidebar/index.js';
	import Disc3 from '@lucide/svelte/icons/disc-3';
	import NavItems from '$lib/components/nav/nav-items.svelte';
	import EngineStatus from '$lib/components/engine/engine-status.svelte';
</script>

<Sidebar collapsible="icon">
	<SidebarHeader>
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size="lg" tooltipContent="iPod Shuffle">
					{#snippet child({ props })}
						<a href="/devices" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
							>
								<Disc3 class="size-4" />
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">iPod Shuffle</span>
								<span class="truncate text-xs text-muted-foreground">sync workbench</span>
							</div>
						</a>
					{/snippet}
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarHeader>
	<SidebarContent>
		<NavItems />
	</SidebarContent>
	<SidebarFooter>
		<SidebarMenu>
			<SidebarMenuItem>
				<!-- Hides the status pill when collapsed to icon mode. -->
				<div class="group-data-[collapsible=icon]:hidden w-full px-2 py-1.5">
					<EngineStatus />
				</div>
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarFooter>
	<SidebarRail />
</Sidebar>
