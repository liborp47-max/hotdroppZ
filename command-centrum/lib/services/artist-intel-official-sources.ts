export type OfficialSourceGroup = {
  region: string
  urls: string[]
}

export const OFFICIAL_SOURCE_GROUPS: OfficialSourceGroup[] = [
  {
    region: 'UK / Ireland',
    urls: [
      'https://www.bbc.co.uk/music',
      'https://www.officialcharts.com',
      'https://www.nme.com',
      'https://www.grmdaily.com',
      'https://www.mixmag.net',
      'https://www.kissfmuk.com',
      'https://www.bbc.co.uk/radio1',
    ],
  },
  {
    region: 'USA',
    urls: [
      'https://www.billboard.com',
      'https://www.rollingstone.com/music',
      'https://www.complex.com/music',
      'https://www.hotnewhiphop.com',
      'https://www.xxlmag.com',
      'https://pitchfork.com',
      'https://www.allmusic.com',
      'https://www.datpiff.com',
    ],
  },
  {
    region: 'Germany',
    urls: [
      'https://www.offiziellecharts.de',
      'https://www.juice.de',
      'https://www.backspin.de',
      'https://www.16bars.de',
      'https://www.mtv.de',
      'https://www.dasding.de',
    ],
  },
  {
    region: 'France',
    urls: [
      'https://www.lescharts.com',
      'https://www.booska-p.com',
      'https://www.nrj.fr',
      'https://www.mouv.fr',
      'https://www.oklm.com',
    ],
  },
  {
    region: 'Spain',
    urls: [
      'https://www.elportaldemusica.es',
      'https://www.los40.com',
      'https://www.rockdelux.com',
      'https://www.hhgroups.com',
      'https://www.rtve.es/radio',
    ],
  },
  {
    region: 'Italy',
    urls: [
      'https://www.fimi.it',
      'https://www.rockol.it',
      'https://www.earone.it',
      'https://www.allmusicitalia.it',
      'https://www.radioitalia.it',
    ],
  },
  {
    region: 'Poland',
    urls: [
      'https://www.olis.pl',
      'https://www.cgm.pl',
      'https://www.popkiller.pl',
      'https://www.newonce.net',
      'https://www.empik.com/music',
    ],
  },
  {
    region: 'Czech Republic',
    urls: [
      'https://ifpicr.cz',
      'https://www.rockandpop.cz',
      'https://www.evropa2.cz',
      'https://www.radio1.cz',
      'https://www.freshradio.cz',
    ],
  },
  {
    region: 'Slovakia',
    urls: [
      'https://ifpi.sk',
      'https://www.radia.sk',
      'https://www.expres.sk',
      'https://www.rukahore.sk',
    ],
  },
  {
    region: 'Netherlands',
    urls: [
      'https://www.dutchcharts.nl',
      'https://www.top40.nl',
      'https://www.pinguinradio.com',
      'https://www.3voor12.vpro.nl',
    ],
  },
  {
    region: 'Sweden',
    urls: [
      'https://www.sverigetopplistan.se',
      'https://www.aftonbladet.se/nojesbladet',
      'https://www.kingsizemag.se',
      'https://www.svt.se/kultur',
    ],
  },
  {
    region: 'Norway',
    urls: [
      'https://www.vglista.no',
      'https://www.p3.no',
      'https://www.dagbladet.no/kultur',
    ],
  },
  {
    region: 'Denmark',
    urls: [
      'https://www.hitlisten.nu',
      'https://www.dr.dk/musik',
      'https://gaffa.dk',
    ],
  },
  {
    region: 'Finland',
    urls: [
      'https://www.ifpi.fi',
      'https://www.soundi.fi',
      'https://www.radioaalto.fi',
    ],
  },
  {
    region: 'Belgium',
    urls: [
      'https://www.ultratop.be',
      'https://www.stubru.be',
      'https://www.hln.be/muziek',
    ],
  },
  {
    region: 'Brazil',
    urls: [
      'https://www.billboard.com.br',
      'https://www.letras.mus.br',
      'https://www.vagalume.com.br',
      'https://www.rapgol.com.br',
    ],
  },
  {
    region: 'Mexico',
    urls: [
      'https://www.billboard.com/charts/mexico',
      'https://www.los40.com.mx',
      'https://www.universalmusicmexico.com',
    ],
  },
  {
    region: 'Turkey',
    urls: [
      'https://www.mu-yap.org',
      'https://www.powerapp.com.tr',
      'https://www.kralmuzik.com.tr',
    ],
  },
  {
    region: 'Russia / CIS',
    urls: [
      'https://tophit.ru',
      'https://www.muz-tv.ru',
      'https://vk.com/music',
    ],
  },
  {
    region: 'Global core',
    urls: [
      'https://open.spotify.com',
      'https://music.apple.com',
      'https://soundcloud.com',
      'https://www.youtube.com',
      'https://www.instagram.com',
      'https://www.tiktok.com',
      'https://musicbrainz.org',
      'https://www.last.fm',
      'https://www.discogs.com',
      'https://genius.com',
    ],
  },
]

export const OFFICIAL_SOURCE_URLS: string[] = Array.from(
  new Set(OFFICIAL_SOURCE_GROUPS.flatMap((group) => group.urls))
)
