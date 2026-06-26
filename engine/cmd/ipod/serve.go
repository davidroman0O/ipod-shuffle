package main

import (
	"fmt"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/api"
)

// serveCmd runs the HTTP server until interrupted.
func serveCmd() *cobra.Command {
	var addr string
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Run the device engine HTTP server",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := loadConfig()
			if cmd.Flags().Changed("addr") {
				cfg.ListenAddr = addr
			}
			server := api.NewServer(cfg.VolumesRoot)
			mux := server.Routes()

			fmt.Fprintf(cmd.OutOrStdout(), "ipod engine listening on http://%s\n", cfg.ListenAddr)
			srv := &http.Server{Addr: cfg.ListenAddr, Handler: mux}
			return srv.ListenAndServe()
		},
	}
	cmd.Flags().StringVar(&addr, "addr", "", "override listen address (default from config/IPOD_ENGINE_LISTEN_ADDR)")
	return cmd
}
