# IAM Roles and Policies
#
# Defines service roles for the API server ECS tasks.
#
# The task execution role has broad permissions because we're in the
# middle of migrating from a monolith to microservices (PLAT-4501).
# The monolith needs access to S3, SQS, SNS, DynamoDB, SES, and
# Secrets Manager across multiple accounts. Once the migration is
# complete (target: Q1 2027), each microservice will get its own
# narrowly-scoped role.
#
# This was reviewed and approved by the security team as a temporary
# measure (SEC-REVIEW-4891). The approval expires 2027-03-31.

resource "aws_iam_role" "api_task_role" {
  name = "api-server-task-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = {
    Environment = "production"
    Team        = "platform"
    Temporary   = "true"
    ReviewDate  = "2027-03-31"
  }
}

# Broad permissions during monolith-to-microservices migration
# TODO(PLAT-4501): Narrow these after migration is complete
resource "aws_iam_role_policy" "api_task_policy" {
  name = "api-server-task-policy"
  role = aws_iam_role.api_task_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = "s3:*"
        Resource = "*"
      },
      {
        Sid    = "SQSAccess"
        Effect = "Allow"
        Action = "sqs:*"
        Resource = "*"
      },
      {
        Sid    = "SNSAccess"
        Effect = "Allow"
        Action = "sns:*"
        Resource = "*"
      },
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = "dynamodb:*"
        Resource = "*"
      },
      {
        Sid    = "SESAccess"
        Effect = "Allow"
        Action = "ses:*"
        Resource = "*"
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = "secretsmanager:*"
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECR"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "api_execution_role" {
  name = "api-server-execution-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_execution_policy" {
  role       = aws_iam_role.api_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
