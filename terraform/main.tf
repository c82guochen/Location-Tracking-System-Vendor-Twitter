terraform {
  required_providers {
    aws = {
        source = "hashicorp/aws"
        version = "~> 4.0"
    }
  }

  backend "s3" {
    
  }
}

provider "aws" {
  region = "${var.aws_region}"
}

data "aws_caller_identity" "current" {
  # git actions中的secrets中的arn
}

locals {
  account_id = data.aws_caller_identity.current.account_id
}