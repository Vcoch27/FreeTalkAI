$ErrorActionPreference = 'Stop'
$profileName = 'aws-starter'
$region = 'ap-southeast-2'

$planText = aws freetier get-account-plan-state --profile $profileName --region us-east-1 --output json --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw "Could not verify the AWS project plan." }
$plan = $planText | ConvertFrom-Json
if ($plan.accountPlanType -ne 'FREE' -or $plan.accountPlanStatus -ne 'ACTIVE') {
    throw "This deployment is configured for the active AWS Free plan. Check the project plan in AWS Settings."
}

uv run --with boto3 --with 'botocore[crt]' python (Join-Path $PSScriptRoot 'update-stack.py')
if ($LASTEXITCODE -ne 0) { throw 'CloudFormation deployment failed.' }
python (Join-Path $PSScriptRoot 'seed-catalogue.py')
if ($LASTEXITCODE -ne 0) { throw 'Could not seed the AWS catalogue.' }
