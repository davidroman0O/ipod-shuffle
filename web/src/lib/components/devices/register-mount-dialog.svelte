<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { devicesApi } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import Usb from '@lucide/svelte/icons/usb';
	import FolderPickerDialog from '$lib/components/common/folder-picker-dialog.svelte';

	let {
		onRegistered
	}: {
		onRegistered?: () => void;
	} = $props();

	let pickerOpen = $state(false);
	let busy = $state(false);

	async function register(mountPath: string) {
		busy = true;
		try {
			await devicesApi.register(mountPath);
			toast.success('Device registered', { description: mountPath });
			onRegistered?.();
		} catch (e) {
			toast.error('Registration failed', { description: (e as Error).message });
		} finally {
			busy = false;
		}
	}
</script>

<button class={buttonVariants({ variant: 'outline', size: 'sm' })} onclick={() => (pickerOpen = true)}>
	<Usb class="size-4" /> Register mount
</button>

<FolderPickerDialog
	bind:open={pickerOpen}
	title="Register a device mount"
	onChoose={register}
/>
