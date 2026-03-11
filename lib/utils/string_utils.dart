/// Normalizacao FORTE de nomes para COMPARACAO entre APIs
///
/// Resolve:
/// - Acentos
/// - Espacos extras
/// - Pontuacao, hifens, barras
/// - Sufixos juridicos/comerciais
/// - Diferencas como: "BECKER-ME" vs "BECKER"
///
/// Nao usar para chamadas HTTP
/// Apenas para comparacao interna
String normalizeName(String value) {
  return value
      .toLowerCase()
      .trim()
      .replaceAll(RegExp(r'[áàãâä]'), 'a')
      .replaceAll(RegExp(r'[éèêë]'), 'e')
      .replaceAll(RegExp(r'[íìîï]'), 'i')
      .replaceAll(RegExp(r'[óòõôö]'), 'o')
      .replaceAll(RegExp(r'[úùûü]'), 'u')
      .replaceAll(RegExp(r'ç'), 'c')
      .replaceAll(RegExp(r'[-–—_/\\.,()]'), ' ')
      .replaceAll(
        RegExp(
          r'\b('
          r'me|mei|ltda|eireli|epp|ei|sa|s\/a|'
          r'ind|industria|comercio|comercial'
          r')\b',
        ),
        '',
      )
      .replaceAll(
        RegExp(r'\b(de|da|do|das|dos|e)\b'),
        '',
      )
      .replaceAll(RegExp(r'[^a-z\s]'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

/// Verifica se dois nomes sao "suficientemente parecidos"
///
/// Usado como fallback quando:
/// - Porta bate
/// - Nome nao bate 100%
bool isSimilarName(String a, String b, {double threshold = 0.7}) {
  if (a.isEmpty || b.isEmpty) return false;

  final partsA = a.split(' ');
  final partsB = b.split(' ');

  final common = partsA.where(partsB.contains).length;
  final minSize = partsA.length < partsB.length ? partsA.length : partsB.length;

  if (minSize == 0) return false;

  final similarity = common / minSize;
  return similarity >= threshold;
}
