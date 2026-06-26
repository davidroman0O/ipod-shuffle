<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { engineApi } from '$lib/api';
	import { onMount } from 'svelte';

	let status = $state<'up' | 'down' | 'checking'>('checking');

	async function check() {
		try {
			const res = await engineApi.health();
			status = res.ok ? 'up' : 'down';
		} catch {
			status = 'down';
		}
	}

	onMount(() => {
		check();
		const interval = setInterval(check, 10_000);
		return () => clearInterval(interval);
	});
</script>

<Badge variant={status === 'up' ? 'default' : 'destructive'} class="gap-1.5">
	<span
		class="size-2 rounded-full {status === 'up'
			? 'bg-emerald-500'
			: status === 'down'
				? 'bg-red-500'
				: 'bg-amber-500 animate-pulse'}"
	></span>
	{status === 'up' ? 'engine up' : status === 'down' ? 'engine down' : 'checking'}
</Badge>
