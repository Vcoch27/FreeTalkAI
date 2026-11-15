"""Update the existing FreeTalk CloudFormation stack using UTF-8 source."""
import subprocess
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

script = Path(__file__).with_name("render-template.py")
template = subprocess.check_output(
    [sys.executable, "-X", "utf8", str(script)], encoding="utf-8")
stack = "freetalk-japanese"
client = boto3.Session(profile_name="aws-starter", region_name="ap-southeast-2").client("cloudformation")
client.validate_template(TemplateBody=template)
try:
    client.update_stack(StackName=stack, TemplateBody=template, Capabilities=["CAPABILITY_IAM"])
except ClientError as error:
    if error.response["Error"]["Message"] != "No updates are to be performed.":
        raise
    print("Stack already matches the template.")
else:
    client.get_waiter("stack_update_complete").wait(
        StackName=stack, WaiterConfig={"Delay": 5, "MaxAttempts": 60})
    print("Stack update complete.")
