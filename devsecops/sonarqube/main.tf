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

variable "sonar_port" {
  description = "Port exposé pour SonarQube"
  type        = number
  default     = 9000
}

resource "docker_image" "sonarqube" {
  name = "sonarqube:community"
}

resource "docker_volume" "sonar_data" {
  name = "sonarqube-data"
}

resource "docker_volume" "sonar_logs" {
  name = "sonarqube-logs"
}

resource "docker_volume" "sonar_extensions" {
  name = "sonarqube-extensions"
}

resource "docker_container" "sonarqube" {
  name  = "sonarqube"
  image = docker_image.sonarqube.image_id

  env = ["SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true"]

  ports {
    internal = 9000
    external = var.sonar_port
  }

  volumes {
    volume_name    = docker_volume.sonar_data.name
    container_path = "/opt/sonarqube/data"
  }

  volumes {
    volume_name    = docker_volume.sonar_logs.name
    container_path = "/opt/sonarqube/logs"
  }

  volumes {
    volume_name    = docker_volume.sonar_extensions.name
    container_path = "/opt/sonarqube/extensions"
  }
}