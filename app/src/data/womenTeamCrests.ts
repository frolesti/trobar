import manifest from './womenTeamCrests.json';

const images: Record<string, number> = {
    alaves: require('../../../assets/app/img/teams/women/alaves.png'),
    alhama: require('../../../assets/app/img/teams/women/alhama.png'),
    arsenal: require('../../../assets/app/img/teams/women/arsenal.png'),
    athletic: require('../../../assets/app/img/teams/women/athletic.png'),
    atletico: require('../../../assets/app/img/teams/women/atletico.png'),
    avaldsnes: require('../../../assets/app/img/teams/women/avaldsnes.png'),
    badalona: require('../../../assets/app/img/teams/women/badalona.png'),
    barcelona: require('../../../assets/app/img/teams/women/barcelona.png'),
    bayern: require('../../../assets/app/img/teams/women/bayern.png'),
    benfica: require('../../../assets/app/img/teams/women/benfica.png'),
    brann: require('../../../assets/app/img/teams/women/brann.png'),
    chelsea: require('../../../assets/app/img/teams/women/chelsea.png'),
    deportivo: require('../../../assets/app/img/teams/women/deportivo.png'),
    frankfurt: require('../../../assets/app/img/teams/women/frankfurt.png'),
    espanyol: require('../../../assets/app/img/teams/women/espanyol.png'),
    granada: require('../../../assets/app/img/teams/women/granada.png'),
    tenerife: require('../../../assets/app/img/teams/women/tenerife.png'),
    hammarby: require('../../../assets/app/img/teams/women/hammarby.png'),
    koge: require('../../../assets/app/img/teams/women/koge.png'),
    levante: require('../../../assets/app/img/teams/women/levante.png'),
    'las-planas': require('../../../assets/app/img/teams/women/las-planas.png'),
    logrono: require('../../../assets/app/img/teams/women/logrono.png'),
    'madrid-cff': require('../../../assets/app/img/teams/women/madrid-cff.png'),
    'manchester-city': require('../../../assets/app/img/teams/women/manchester-city.png'),
    leuven: require('../../../assets/app/img/teams/women/leuven.png'),
    lyon: require('../../../assets/app/img/teams/women/lyon.png'),
    'paris-fc': require('../../../assets/app/img/teams/women/paris-fc.png'),
    rayo: require('../../../assets/app/img/teams/women/rayo.png'),
    betis: require('../../../assets/app/img/teams/women/betis.png'),
    'real-madrid': require('../../../assets/app/img/teams/women/real-madrid.png'),
    'real-sociedad': require('../../../assets/app/img/teams/women/real-sociedad.png'),
    roma: require('../../../assets/app/img/teams/women/roma.png'),
    rosengard: require('../../../assets/app/img/teams/women/rosengard.png'),
    eibar: require('../../../assets/app/img/teams/women/eibar.png'),
    servette: require('../../../assets/app/img/teams/women/servette.png'),
    sevilla: require('../../../assets/app/img/teams/women/sevilla.png'),
    huelva: require('../../../assets/app/img/teams/women/huelva.png'),
    'st-polten': require('../../../assets/app/img/teams/women/st-polten.png'),
    valencia: require('../../../assets/app/img/teams/women/valencia.png'),
    wolfsburg: require('../../../assets/app/img/teams/women/wolfsburg.png'),
    villarreal: require('../../../assets/app/img/teams/women/villarreal.png'),
};

const normalize = (name: string) => name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\u00f8/g, 'o').replace(/\b(women|ladies|frauen|femenino|femenina|femeni|fem)\b/g, '').replace(/[^a-z0-9]/g, '');
const byName = Object.fromEntries(manifest.flatMap(team => team.names.map(name => [normalize(name), images[team.key]])));

export function getWomenTeamCrest(name: string): number | undefined {
    return byName[normalize(name)];
}