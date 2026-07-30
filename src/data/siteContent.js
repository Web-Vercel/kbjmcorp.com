export const business = {
  name: 'KBJM',
  legalName: 'KBJM International Trading',
  domain: 'www.kbjmcorp.com',
  email: 'info@kbjmcorp.com',
  emailHref: 'mailto:info@kbjmcorp.com',
  canadaPhone: '(604) 355-9763',
  canadaPhoneHref: 'tel:+16043559763',
  chinaPhone: '+86 139 7600 7282',
  chinaPhoneHref: 'tel:+8613976007282',
  offices: [
    {
      city: 'Vancouver, Canada',
      cityZh: '加拿大温哥华',
      label: 'North American Headquarters',
      labelZh: '北美总部',
      address: '1486 W. Hastings Street\nVancouver, BC, Canada',
      addressZh: '1486 W. Hastings Street\n温哥华, BC, 加拿大',
      phone: '(604) 355-9763',
      phoneHref: 'tel:+16043559763',
      hours: 'Mon – Fri, 9:00 AM – 6:00 PM PT',
      hoursZh: '周一至周五，上午9:00 – 下午6:00 PT',
      image: '/images/vancouver-office.jpg'
    },
    {
      city: 'Hainan, China',
      cityZh: '中国海南',
      label: 'Asia-Pacific Operations',
      labelZh: '亚太运营中心',
      address: '13F, Building 4, Block B, Phase 6, Greenland Haichangliu\nNo. 1 Binxi First Street, Xiuying District\nHaikou, Hainan, China',
      addressZh: '绿地海长流六期B座4号楼13层\n秀英区滨西一街1号\n中国海南省海口市',
      phone: '+86 139 7600 7282',
      phoneHref: 'tel:+8613976007282',
      hours: 'Mon – Fri, 9:00 AM – 6:00 PM CST',
      hoursZh: '周一至周五，上午9:00 – 下午6:00 CST',
      image: '/images/haikou-contact.jpg'
    }
  ]
  // TODO(owner): Confirm Vancouver address conflict: SEO source says 1030 W Georgia St, while Contact source says 1486 W Hastings St.
}

export const sectors = [
  {
    key: 'mining',
    title: 'Mining Products',
    titleZh: '矿产品',
    description: 'Nickel ore, gold, silver, copper concentrate, zinc, and other mineral commodities.',
    descriptionZh: '镍矿、金、银、铜精矿、锌及其他矿产大宗商品。',
    image: '/images/mining.jpg'
  },
  {
    key: 'energy',
    title: 'Natural Energy',
    titleZh: '天然能源',
    description: 'LNG and selected energy commodities for cross-border markets.',
    descriptionZh: '面向跨境市场的液化天然气及精选能源产品。',
    image: '/images/energy.jpg'
  },
  {
    key: 'agriculture',
    title: 'Agricultural Goods',
    titleZh: '农产品',
    description: 'Canola, grains, oilseeds, and produce connecting suppliers with buyers.',
    descriptionZh: '连接供应商与买家的油菜籽、谷物、油籽及农产品。',
    image: '/images/agriculture.jpg'
  },
  {
    key: 'forestry',
    title: 'Forestry Products',
    titleZh: '林业产品',
    description: 'Higher-grade and engineered wood from North American supply networks.',
    descriptionZh: '来自北美供应网络的高等级木材及工程木材。',
    image: '/images/forestry.jpg'
  }
]

export const trade = {
  buy: [
    ['Lateritic Nickel Ore', 'Mining', 'Ni 1.0–1.8% / Fe 35% min / Moisture 35% max', '100,000 WMT', 'Active'],
    ['Canola Seeds', 'Agriculture', 'Oil 40–44% min / Moisture 10% max / No. 1 Canada Grade', '60,000 MT', 'Active']
  ],
  sell: [
    ['Eureka Lemon', 'Agriculture', 'Vitamin C 32.6mg/100g / Soluble solids 15.3% / Acidity 6.86%', '750,000+ kg', 'Active'],
    ['Lateritic Nickel Ore', 'Mining', 'Ni 1.0–1.8% / Fe 35% min / Moisture 35% max', '100,000 WMT', 'Active'],
    ['Gold Doré', 'Mining', 'Au 85–95% / Ag balance / Assay certified', '500 kg', 'Active'],
    ['Silver Bullion', 'Mining', '999 fine silver / LBMA approved', '5,000 troy oz', 'Active'],
    ['Copper Concentrate', 'Mining', 'Cu 25% min / Au 5g/t / Ag 80g/t', '20,000 DMT', 'Active'],
    ['Zinc Concentrate', 'Mining', 'Zn 50% min / Pb 2% max / Moisture 10% max', '15,000 DMT', 'Active'],
    ['LNG', 'Energy', 'Spot cargo / DES basis', '60,000 CBM', 'Pending'],
    ['Higher-Grade Engineered Wood', 'Forestry', 'CLT / Glulam / LVL / FSC certified', '5,000 m³', 'Pending']
  ]
}

export const team = [
  ['Qin Li', 'Managing Director', 'Vancouver'],
  ['Kenny HD Lu', 'VP, Asia-Pacific Commodities', 'Vancouver'],
  ['Qin Ming Wu', 'Director, China Operations', 'Hainan'],
  ['Kevin Tang', 'VP, Trade Finance', 'Vancouver'],
  ['Alex Lam', 'Head of Logistics', 'Vancouver'],
  ['Michelle Y. Zhang', 'Senior Trader, Mining', 'Hainan'],
  ['Robert J. Patel', 'Senior Trader, Energy', 'Vancouver']
  // TODO(owner): Confirm all names, roles, credentials, and biographies before production launch.
]

export const copy = {
  en: {
    nav: { home: 'Home', about: 'About', trade: 'Trade', team: 'Team', news: 'News', contact: 'Contact' },
    tagline: 'Global Commodity Trade & Supply Chain Solutions',
    heroBadge: 'International Trade & Commodities',
    hero1: 'Connecting Markets',
    hero2: 'Across the Pacific',
    heroText: 'Commodity sourcing, trade brokerage, and end-to-end supply chain execution across mining, energy, agriculture, and forestry.',
    explore: 'Explore trade',
    learn: 'Learn more',
    sectors: 'Global Commodity Expertise',
    sectorsText: 'From mine to market, field to factory—we coordinate the movement of essential resources across borders.',
    contact: 'Get in touch',
    contactText: 'Discuss sourcing, supply, trade opportunities, or potential partnerships with our team.'
  },
  zh: {
    nav: { home: '首页', about: '关于', trade: '贸易', team: '团队', news: '新闻', contact: '联系' },
    tagline: '国际大宗商品贸易与供应链解决方案',
    heroBadge: '国际贸易与大宗商品',
    hero1: '连接市场',
    hero2: '跨越太平洋',
    heroText: '覆盖矿业、能源、农业和林业的大宗商品采购、贸易经纪及端到端供应链执行。',
    explore: '探索贸易',
    learn: '了解更多',
    sectors: '全球大宗商品专业能力',
    sectorsText: '从矿山到市场，从田间到工厂——我们协调重要资源的跨境流通。',
    contact: '联系我们',
    contactText: '与我们的团队讨论采购、供应、贸易机会或潜在合作。'
  }
}
