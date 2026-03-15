import json
import math
import os
import re
import asyncio
from scrapfly import ScrapeApiResponse, ScrapeConfig, ScrapflyClient
from dotenv import load_dotenv
load_dotenv()




BASE_CONFIG = {
    "asp": True,
    "country": "US",
    # Us locale, apply localization settings from the browser and then copy the aep_usuc_f cookie from devtools
    "headers": {
        "cookie": "aep_usuc_f=site=glo&province=&city=&c_tp=USD&region=US&b_locale=en_US&ae_u_p_s=2"
    }
}

scrapfly = ScrapflyClient(key=os.environ['API_KEY'])