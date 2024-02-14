// 记得按照自己的进行修改！！！！
variable "aws_vpc_id" {
  type          = string
  description   = "AWS VPC ID deployed from network repo"
  default       = "vpc-07f00de02e8d24e90" # CHANGE TO YOUR OWN VPC ID
}

variable "aws_public_subnet_ids" {
  description = "public subnet ids"
  default     = ["subnet-0d5bc41ad5a00ddbc", "subnet-0e95ae59b84d540cd"] # CHANGE TO YOUR SUBNET IDS
}

variable "aws_private_subnet_ids" {
  description = "private subnet ids"
  default     = ["subnet-007cf08e5b4270707", "subnet-0707c6621af08c977"] # CHANGE TO YOUR SUBNET IDS
}

variable "aws_region" {}

variable "app_name" {
  type        = string
  description = "Application Name"
  default = "Vendor-Twitter"
}

// 在AWS (Amazon Web Services) 的环境中，ecs_env_vars.json文件通常用于定义环境变量
// 这些环境变量会被AWS的ECS（Elastic Container Service）服务用于容器的配置
// 该文件不会上传到github中，会被手动存到S3中
variable "ecs_twitter_env_secrets_key" {
  description = "Secrets key file"
  default = "ecs_env_vars.json"
}

variable "ecs_twitter_env_secrets_folder" {
  description = "Secrets S3 folder"
  default = "cg-vendor-twitter-secrets"
    # 存放文件的路径（bucket需要aws全局unique）
} 

variable "dynamodb_vendor_table_name" {
  description = "Table name for dynamodb vendors"
  default = "vendors"
}

variable "sqs_queue_name" {
  description = "Name for SQS queue"
  default = "vendor-twitter-queue"
}

variable "image_tag" {}