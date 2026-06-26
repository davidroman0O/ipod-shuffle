package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/discover"
)

// devicesCmd prints discovered iPod volumes as JSON.
func devicesCmd() *cobra.Command {
	var volumesRoot string
	cmd := &cobra.Command{
		Use:   "devices",
		Short: "List discovered iPod Shuffle volumes",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := loadConfig()
			if cmd.Flags().Changed("volumes") {
				cfg.VolumesRoot = volumesRoot
			}
			devices, err := discover.Discover(context.Background(), cfg.VolumesRoot, discover.DefaultFS, discover.DefaultRunner)
			if err != nil {
				return err
			}
			out, err := json.MarshalIndent(devices, "", "  ")
			if err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), string(out))
			return nil
		},
	}
	cmd.Flags().StringVar(&volumesRoot, "volumes", "", "override volumes root (default from config)")
	return cmd
}
