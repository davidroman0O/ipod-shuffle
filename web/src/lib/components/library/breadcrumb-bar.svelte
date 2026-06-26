<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import HardDrive from '@lucide/svelte/icons/hard-drive';

	let {
		dir,
		onNavigate
	}: {
		dir: string;
		onNavigate: (dir: string) => void;
	} = $props();

	// Split the absolute path into clickable segments: /, Users, me, Music
	const segments = $derived.by(() => {
		const parts = dir.split('/').filter(Boolean);
		const segs: { label: string; dir: string }[] = [{ label: '/', dir: '/' }];
		let acc = '';
		for (const part of parts) {
			acc += '/' + part;
			segs.push({ label: part, dir: acc });
		}
		return segs;
	});
</script>

<nav class="flex flex-wrap items-center gap-0.5 text-sm">
	{#each segments as seg, i (seg.dir)}
		{#if i > 0}
			<ChevronRight class="size-3.5 text-muted-foreground" />
		{/if}
		<button
			class="max-w-[12rem] truncate rounded px-1.5 py-0.5 hover:bg-accent {i ===
			segments.length - 1
				? 'font-medium text-foreground'
				: 'text-muted-foreground'}"
			onclick={() => onNavigate(seg.dir)}
		>
			{#if i === 0}
				<HardDrive class="inline size-3.5" />
			{:else}
				{seg.label}
			{/if}
		</button>
	{/each}
</nav>
