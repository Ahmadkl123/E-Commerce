terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {
  host = "npipe:////.//pipe//docker_engine"
}

variable "prometheus_port" {
  description = "Port exposé pour Prometheus"
  type        = number
  default     = 9090
}

variable "grafana_port" {
  description = "Port exposé pour Grafana"
  type        = number
  default     = 3000
}

resource "docker_network" "monitoring" {
  name = "monitoring-net"
}

resource "docker_image" "prometheus" {
  name = "prom/prometheus:latest"
}

resource "docker_image" "grafana" {
  name = "grafana/grafana:latest"
}

resource "docker_container" "prometheus" {
  name  = "prometheus"
  image = docker_image.prometheus.image_id

  networks_advanced {
    name = docker_network.monitoring.name
  }

  ports {
    internal = 9090
    external = var.prometheus_port
  }

  volumes {
    host_path      = abspath("${path.module}/prometheus.yml")
    container_path = "/etc/prometheus/prometheus.yml"
  }
}

resource "docker_container" "grafana" {
  name  = "grafana"
  image = docker_image.grafana.image_id

  networks_advanced {
    name = docker_network.monitoring.name
  }

  ports {
    internal = 3000
    external = var.grafana_port
  }
}