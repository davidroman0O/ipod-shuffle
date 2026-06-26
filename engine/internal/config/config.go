// Package config loads engine configuration via Viper (environment variables
// and optional config file). It deliberately holds only transport/operational
// settings — no product state (that lives in the Moleculer layer).
package config

import (
	"fmt"

	"github.com/spf13/viper"
)

// Config is the engine's runtime configuration.
type Config struct {
	ListenAddr  string `mapstructure:"listen_addr"`
	VolumesRoot string `mapstructure:"volumes_root"`
}

// Defaults applied when neither env nor config file supplies a value.
const (
	DefaultListenAddr  = "127.0.0.1:8765"
	DefaultVolumesRoot = "/Volumes"
)

// Bind registers viper keys with environment variable bindings and defaults.
// Exported so tests can rebind into a fresh viper instance.
func Bind(v *viper.Viper) {
	v.SetDefault("listen_addr", DefaultListenAddr)
	v.SetDefault("volumes_root", DefaultVolumesRoot)
	v.SetEnvPrefix("IPOD_ENGINE")
	v.AutomaticEnv()
}

// Load reads configuration from the default viper instance.
func Load() (Config, error) {
	v := viper.New()
	Bind(v)
	return load(v)
}

func load(v *viper.Viper) (Config, error) {
	var c Config
	if err := v.Unmarshal(&c); err != nil {
		return Config{}, fmt.Errorf("unmarshal config: %w", err)
	}
	return c, nil
}
