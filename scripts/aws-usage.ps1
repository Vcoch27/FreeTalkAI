$ErrorActionPreference = 'Stop'

function Invoke-CheckedAws {
    & aws @args --no-cli-pager
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI returned exit code $LASTEXITCODE."
    }
}

Write-Output 'AWS Free plan and credits'
Invoke-CheckedAws freetier get-account-plan-state --profile aws-starter --region us-east-1 --query '{plan:accountPlanType,status:accountPlanStatus,remaining:accountPlanRemainingCredits,expires:accountPlanExpirationDate}'

Write-Output 'Project usage by service this billing period'
Invoke-CheckedAws freetier get-free-tier-usage --profile aws-starter --region us-east-1 --query 'freeTierUsages[].{service:service,usage:usageType,used:actualUsageAmount,limit:limit,unit:unit}'

$now = [DateTime]::UtcNow
$from = $now.AddDays(-7).ToString('yyyy-MM-ddTHH:mm:ssZ')
$to = $now.ToString('yyyy-MM-ddTHH:mm:ssZ')

Write-Output 'FreeTalk Lambda counts over the last 7 days (UTC)'
foreach ($metric in @('Invocations','Errors','Throttles')) {
    $raw = Invoke-CheckedAws cloudwatch get-metric-statistics --profile aws-starter --region ap-southeast-2 --namespace AWS/Lambda --metric-name $metric --dimensions 'Name=FunctionName,Value=freetalk-japanese' --start-time $from --end-time $to --period 86400 --statistics Sum --output json
    $points = ($raw | ConvertFrom-Json).Datapoints
    [pscustomobject]@{ Metric = $metric; Sum = if ($points) { ($points | Measure-Object -Property Sum -Sum).Sum } else { 0 }; DataPoints = @($points).Count }
}
