library string_utils;

/// Normalização FORTE de nomes para COMPARAÇÃO entre APIs
///
/// Resolve:
/// - Acentos
/// - Espaços extras
/// - Pontuação, hífens, barras
/// - Sufixos jurídicos/comerciais
/// - Diferenças como: "BECKER-ME" vs "BECKER"
///
/// ⚠️ NÃO usar para chamadas HTTP
/// ⚠️ Apenas para comparação interna
String normalizeName(String value) {
  return value
      .toLowerCase()
      .trim()

      // 🔹 remove acentos
      .replaceAll(RegExp(r'[áàãâä]'), 'a')
      .replaceAll(RegExp(r'[éèêë]'), 'e')
      .replaceAll(RegExp(r'[íìîï]'), 'i')
      .replaceAll(RegExp(r'[óòõôö]'), 'o')
      .replaceAll(RegExp(r'[úùûü]'), 'u')
      .replaceAll(RegExp(r'ç'), 'c')

      // 🔹 substitui pontuações por espaço
      .replaceAll(RegExp(r'[-–—_/\\.,()]'), ' ')

      // 🔹 remove sufixos jurídicos/comerciais
      .replaceAll(
        RegExp(
          r'\b('
          r'me|mei|ltda|eireli|epp|ei|sa|s\/a|'
          r'ind|industria|comercio|comercial'
          r')\b',
        ),
        '',
      )

      // 🔹 remove palavras de ligação pouco relevantes
      .replaceAll(
        RegExp(r'\b(de|da|do|das|dos|e)\b'),
        '',
      )

      // 🔹 remove qualquer coisa que não seja letra ou espaço
      .replaceAll(RegExp(r'[^a-z\s]'), '')

      // 🔹 normaliza espaços
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

/// Verifica se dois nomes são "suficientemente parecidos"
///
/// Usado como fallback quando:
/// - Porta bate
/// - Nome não bate 100%
///
/// Exemplo:
/// "sociedade beneficencia caridade brochier"
/// vs
/// "beneficencia caridade brochier"
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
