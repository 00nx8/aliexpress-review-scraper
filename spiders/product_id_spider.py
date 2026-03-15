import scrapy

DOMAINS = []

BASE_CONFIG = {
    "asp": True,
    "country": "US",
    # Us locale, apply localization settings from the browser and then copy the aep_usuc_f cookie from devtools
    "headers": {
        "cookie": 'aep_usuc_f:"site=nld&c_tp=EUR&ups_d=1|1|1|1&ups_u_t=1789113933481&region=NL&b_locale=nl_NL&ae_u_p_s=2"'
    }
}


class ProductIdSpider(scrapy.Spider):
    name = "product_id_spider"
