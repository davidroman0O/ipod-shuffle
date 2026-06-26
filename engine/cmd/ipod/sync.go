package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/api"
	"github.com/davidroman0O/ipod-shuffle/engine/internal/sync"
)

// syncCmd executes a sync described by a JSON request file (same shape as
// POST /v1/sync). It reuses the same engine conversion + sync logic as the HTTP
// API so behaviour stays identical across both surfaces.
func syncCmd() *cobra.Command {
	var planOnly bool
	var inputFile string
	cmd := &cobra.Command{
		Use:   "sync",
		Short: "Sync a device from a JSON request file (see openapi.yaml)",
		RunE: func(cmd *cobra.Command, args []string) error {
			req, err := readRequest(inputFile)
			if err != nil {
				return err
			}
			tracks, playlists := api.BuildEngineModel(req)

			plan, err := sync.Plan(req.MountPath, tracks, playlists, sync.DefaultFS)
			if err != nil {
				return fmt.Errorf("plan: %w", err)
			}
			if planOnly {
				return emit(cmd, plan)
			}
			result, err := sync.ExecuteAt(plan, sync.DefaultFS, time.Now())
			if err != nil {
				return fmt.Errorf("execute: %w", err)
			}
			return emit(cmd, result)
		},
	}
	cmd.Flags().StringVarP(&inputFile, "file", "f", "", "path to JSON sync request (required)")
	cmd.Flags().BoolVar(&planOnly, "plan", false, "dry-run: print the plan without writing")
	_ = cmd.MarkFlagRequired("file")
	return cmd
}

func readRequest(path string) (api.SyncRequest, error) {
	var req api.SyncRequest
	raw, err := os.ReadFile(path)
	if err != nil {
		return req, fmt.Errorf("read request file: %w", err)
	}
	if err := json.Unmarshal(raw, &req); err != nil {
		return req, fmt.Errorf("parse request: %w", err)
	}
	if req.MountPath == "" {
		return req, fmt.Errorf("mountPath is required")
	}
	return req, nil
}

func emit(cmd *cobra.Command, v any) error {
	out, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintln(cmd.OutOrStdout(), string(out))
	return nil
}
